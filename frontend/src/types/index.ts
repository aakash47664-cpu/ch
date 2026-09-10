export type SourceType = 'real' | 'demo' | 'simulated';

export type SeverityLevel = 'NORMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type FaultMode = 
  | 'normal'
  | 'early_pump_degradation'
  | 'early_heat_exchanger_fouling'
  | 'early_reactor_cooling_degradation'
  | 'early_distillation_reflux_loss'
  | 'pump_fault' 
  | 'heat_exchanger_fault' 
  | 'reactor_cooling_failure' 
  | 'distillation_fault'
  | 'unknown_fault';

export interface XaiContributionItem {
  feature: string;
  label: string;
  change: string;
  contributionPercent: number;
  isUp: boolean;
  zScore?: number;
}

export interface PrognosisData {
  degradationPercent: number;
  trend: string;
  riskStage: string;
  timeToThreshold: string;
  narrative: string;
  isEarlyWarning?: boolean;
  isCritical?: boolean;
}

export interface PreventiveData {
  riskScore: number;
  riskStage: string;
  observedEvidence: string;
  probableCause: string;
  preventiveMeasure: string;
  verificationRequired: boolean;
  recommendationAllowed: boolean;
  reason?: string;
}

export interface SensorReliabilityData {
  score: number;
  isReliable: boolean;
  statusText: string;
  details: Array<{
    name: string;
    ok: boolean;
    status: string;
    note: string;
  }>;
}

export interface SafetyGateData {
  gateState: string;
  statusLabel: string;
  safeToRecommend: boolean;
  actionBlocked: boolean;
  requiresOperatorApproval: boolean;
  bannerType: 'safe' | 'blocked' | 'warning' | 'critical' | 'unknown';
  headline: string;
  reason: string;
  directive: string;
}

export interface OperatorApprovalData {
  required: boolean;
  approved: boolean;
  message: string;
  approvedAt?: string;
}

export interface Diagnosis {
  equipment: string;
  anomaly: boolean;
  anomaly_score?: number;
  is_unknown_fault?: boolean;
  fault: string;
  probable_fault: string;
  root_cause: string;
  severity: SeverityLevel;
  confidence: number;
  pattern_match_quality?: string;
  important_variables: string[];
  evidence_cards?: Array<{ label: string; val: string; state: string; isWarning: boolean }>;
  pattern_narrative?: string;
  explanation?: string;
  severity_reason?: string;
  system_status?: string;
  assessment?: string;
  ai_reasoning?: string;
  normal_variables?: Array<{ name: string; val: string; status: string }>;
  recommended_action: string;
  xai_contributions?: XaiContributionItem[];
  prognosis?: PrognosisData;
  preventive?: PreventiveData;
  sensorReliability?: SensorReliabilityData;
  safetyGate?: SafetyGateData;
  operatorApproval?: OperatorApprovalData;
  timestamp: string;
}

export interface AlertItem {
  id?: number;
  timestamp: string;
  equipment: string;
  fault: string;
  root_cause: string;
  severity: SeverityLevel;
}

export interface ProcessStream {
  id: string; // "01", "02", "03", "04", "05", "06"
  name: string;
  from: string;
  to: string;
  flow: number; // L/min
  temperature: number; // °C
  pressure: number; // bar
  reflux_ratio?: number;
  reflux_flow?: number; // L/min
}

export interface ProcessStreams {
  stream_1: ProcessStream;
  stream_2: ProcessStream;
  stream_3: ProcessStream;
  stream_4: ProcessStream;
  stream_5: ProcessStream;
  stream_6: ProcessStream;
}

export interface ManualControlOverrides {
  pump_rpm?: number | null;
  heat_exchanger_efficiency?: number | null;
  cooling_status?: number | null;
  reflux_ratio?: number | null;
  agitator_speed?: number | null;
}

export interface PumpData {
  rpm: number;
  vibration: number;
  flow?: number; // L/min
  inlet_temperature: number;
  outlet_temperature: number;
  pressure?: number; // bar
  status?: string;
  health?: number;
  source?: SourceType;
}

export interface HeatExchangerData {
  inlet_temperature: number;
  outlet_temperature: number;
  temperature_difference: number;
  heat_transfer_indicator: number;
  efficiency?: number; // %
  status?: string;
  health?: number;
  source?: SourceType;
}

export interface ReactorData {
  temperature: number;
  pressure: number;
  level: number;
  agitator_speed: number;
  cooling_status: number;
  feed_flow?: number;
  feed_temperature?: number;
  status?: string;
  health?: number;
}

export interface DistillationData {
  top_temperature: number;
  bottom_temperature: number;
  pressure: number;
  level: number;
  reflux_ratio: number;
  feed_flow?: number;
  feed_temperature?: number;
  distillate_flow?: number;
  reflux_flow?: number;
  bottoms_flow?: number;
  status?: string;
  health?: number;
}

export interface EquipmentItem<T> {
  id: string;
  name: string;
  source: SourceType;
  source_label: 'REAL DATA' | 'DEMO / SIMULATED' | 'SIMULATED DATA';
  data: T;
}

export interface ProcessUpdatePayload {
  type: string;
  timestamp: string;
  active_fault_mode: FaultMode;
  fault_severity?: number;
  esp32_status: {
    connected: boolean;
    status: string;
    message: string;
  };
  equipment: {
    pump: EquipmentItem<PumpData>;
    heat_exchanger: EquipmentItem<HeatExchangerData>;
    reactor: EquipmentItem<ReactorData>;
    distillation: EquipmentItem<DistillationData>;
  };
  streams?: ProcessStreams;
  controls?: ManualControlOverrides;
  diagnosis: Diagnosis;
}

export interface TimeSeriesPoint {
  time: string;
  pumpVibration: number;
  pumpRpm: number;
  pumpFlow?: number;
  hxDeltaT: number;
  hxOutletTemp: number;
  reactorTemp: number;
  reactorPressure: number;
  distTopTemp: number;
  distReflux: number;
  riskScore?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  equipment?: string;
  provider?: 'ai_assistant' | 'local_rule_engine' | 'groq_industrial_ai' | 'industrial_ai' | string;
  evidence?: Array<{ label: string; val: string; state: string }>;
}

export interface ChatResponse {
  success?: boolean;
  response?: string;
  answer?: string;
  equipment?: string;
  evidence?: Array<{ label: string; val: string; state: string }>;
  provider?: 'ai_assistant' | 'local_rule_engine' | 'groq_industrial_ai' | 'industrial_ai' | 'Groq' | string;
  timestamp?: string;
  error?: string;
}
