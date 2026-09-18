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
  id: string; // "01", "02", "03", "04", "05", "06", "S-100", etc.
  tag?: string; // "S-100", "S-101", "S-102", "S-103", "S-104", "S-105", "S-106"
  name: string;
  from: string;
  to: string;
  flow?: number; // L/min
  flow_rate?: number; // L/min
  temperature: number; // °C
  pressure: number; // bar
  status?: 'nominal' | 'warning' | 'critical' | 'NORMAL' | 'REDUCED' | 'ABNORMAL' | 'NO_FLOW' | string;
  flow_deviation?: number; // %
  reflux_ratio?: number;
  reflux_flow?: number; // L/min
  composition?: Record<string, number>;
}

export type ProcessStreams = ProcessStream[] | Record<string, ProcessStream>;


export interface ManualControlOverrides {
  pump_rpm?: number | null;
  suction_restriction?: number | null;
  discharge_restriction?: number | null;
  pump_condition?: string | null;
  heat_exchanger_efficiency?: number | null;
  fouling_level?: number | null;
  thermal_condition?: string | null;
  cooling_status?: number | null;
  agitator_speed?: number | null;
  reaction_kinetics_mod?: number | null;
  reflux_ratio?: number | null;
  reboiler_duty_mod?: number | null;
  column_pressure_setpoint?: number | null;
}

export type ProcessNodeRole =
  | 'PRIMARY_SOURCE'
  | 'NOMINAL'
  | 'PRIMARY_FAULT'
  | 'PRIMARY_DEGRADATION'
  | 'DOWNSTREAM_EFFECT'
  | 'BYPASS';

export interface ProcessGraphNode {
  id: string; // e.g. "P-101", "E-101", "R-101", "D-101"
  equipmentId?: string; // "pump", "heat_exchanger", "reactor", "distillation"
  name: string;
  type: string; // "PUMP", "HEAT_EXCHANGER", "CSTR", "DISTILLATION", etc.
  enabled: boolean;
  role: ProcessNodeRole;
  upstreamUnit?: string;
  downstreamUnit?: string;
  inputs?: string[];
  outputs?: string[];
  parameters?: Record<string, any>;
}

export interface ProcessGraphConnection {
  id: string; // "P101_E101"
  from: string; // "P-101"
  to: string; // "E-101"
  fromPort?: string; // "outlet"
  toPort?: string; // "inlet"
  streamId?: string; // "02"
  flow: number; // L/min
  status?: string; // "CONNECTED"
  valid?: boolean;
}

export interface ProcessGraphAvailableType {
  type: string;
  name: string;
  defaultTag: string;
  description: string;
  maxInputs: number;
  maxOutputs: number;
}

export interface ProcessGraphState {
  nodes: Record<string, ProcessGraphNode>;
  sequence: string[];
  connections: ProcessGraphConnection[];
  availableTypes: ProcessGraphAvailableType[];
  isValid: boolean;
  validationMessage: string;
}

export interface PumpData {
  rpm: number;
  vibration: number;
  flow?: number; // L/min
  flow_rate?: number; // L/min
  inlet_temperature: number;
  outlet_temperature: number;
  pressure?: number; // bar
  discharge_pressure?: number;
  suction_pressure?: number;
  head?: number; // m
  efficiency?: number; // %
  power_kw?: number; // kW
  suction_restriction?: number;
  discharge_restriction?: number;
  pump_condition?: string;
  status?: string;
  health?: number;
  source?: SourceType;
}

export interface HeatExchangerData {
  flow?: number; // L/min
  flow_rate?: number;
  inlet_temperature: number;
  outlet_temperature: number;
  temp_in?: number;
  temp_out?: number;
  temperature_difference: number;
  delta_t?: number;
  delta_p?: number;
  heat_transfer_indicator: number;
  efficiency?: number; // %
  heat_duty?: number; // kW
  overall_u?: number; // W/(m2*K)
  fouling_factor?: number; // m2*K/W
  fouling_level?: number; // %
  thermal_condition?: string | number;
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
  cooling_flow?: number;
  feed_flow?: number;
  feed_temperature?: number;
  residence_time?: number; // min
  conversion?: number; // %
  heat_generation?: number; // kW
  heat_removal?: number; // kW
  reaction_kinetics_mod?: number;
  status?: string;
  health?: number;
}

export interface DistillationData {
  top_temperature: number;
  bottom_temperature: number;
  pressure: number;
  column_pressure?: number;
  level: number;
  bottoms_level?: number;
  reflux_ratio: number;
  feed_flow?: number;
  feed_temperature?: number;
  distillate_flow?: number;
  reflux_flow?: number;
  bottoms_flow?: number;
  reboiler_duty?: number; // kW
  condenser_duty?: number; // kW
  separation_purity?: number; // %
  reboiler_duty_mod?: number; // %
  column_pressure_setpoint?: number; // bar
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

export interface IntelligentAlert {
  id: string;
  alert_key?: string;
  equipment: string;
  title: string;
  parameter?: string;
  current_value: string | number;
  expected_range?: string;
  unit?: string;
  severity: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO' | 'NORMAL' | SeverityLevel;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'CLEARED';
  explanation?: string;
  likely_cause: string;
  process_impact: string;
  related_effects?: string[];
  triggered_at: string;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  cleared_at?: string | null;
}

export interface AlertSummary {
  totalActive: number;
  activeCount: number;
  critical: number;
  criticalCount: number;
  high: number;
  highCount: number;
  warning: number;
  warningCount: number;
  info: number;
  infoCount: number;
  acknowledgedCount: number;
}

export interface VariableMetric {
  key: string;
  name: string;
  unit: string;
  current: number;
  baseline: number;
  delta: number;
  deltaPercent: number;
  rateOfChangePerMin: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  penalty: number;
  isDeviated: boolean;
}

export interface EquipmentHealthItem {
  id: string;
  equipment: string;
  name: string;
  health: number;
  stage: 'NORMAL' | 'EARLY_DEVIATION' | 'EARLY_DEGRADATION' | 'DEVELOPING_FAULT' | 'HIGH_RISK' | 'FAULT_CONFIRMED' | string;
  label: string;
  color: string;
  severity: SeverityLevel;
  primaryVar: string;
  trend?: 'increasing' | 'decreasing' | 'stable';
  metrics?: Record<string, VariableMetric>;
}

export interface EquipmentHealthMap {
  pump: EquipmentHealthItem;
  heat_exchanger: EquipmentHealthItem;
  reactor: EquipmentHealthItem;
  distillation: EquipmentHealthItem;
}

export interface ProcessHealthData {
  score: number;
  stage: 'NORMAL' | 'EARLY_DEVIATION' | 'EARLY_DEGRADATION' | 'DEVELOPING_FAULT' | 'HIGH_RISK' | 'FAULT_CONFIRMED' | string;
  label: string;
  color: string;
  severity: SeverityLevel;
  summary: string;
}

export interface EarlyWarningItem {
  id: string;
  equipment: string;
  equipment_id?: string;
  title: string;
  stage: string;
  stageLabel: string;
  severity: SeverityLevel;
  health: number;
  summary: string;
  evidence: string[];
  primaryVariable: string;
  recommendedAction: string;
}

export interface WhatChangedItem {
  key: string;
  name: string;
  current: number;
  baseline: number;
  unit: string;
  deltaPercent: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  rateOfChange: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface WatchListItem {
  id: string;
  equipment: string;
  name: string;
  health: number;
  stage: string;
  stageLabel: string;
  severity: SeverityLevel;
  attentionLevel: 'CRITICAL ATTENTION' | 'HIGH ATTENTION' | 'MODERATE ATTENTION' | 'NORMAL';
  attentionRank: number;
  primaryIssue: string;
  keyVars: Array<{ name: string; val: string; trend?: string }>;
}

export interface CausalPropagationData {
  primarySource: string;
  downstreamConsequences: Array<{ unit: string; impact: string }>;
}

export interface EquipmentDiagnosticItem {
  equipmentId: string;
  tag: string;
  name: string;
  anomalyScore: number;
  anomaly: boolean;
  faultClass: string;
  faultLabel: string;
  faultProbability: number;
  probabilities?: Record<string, number>;
  isUnknownFault?: boolean;
  health: number;
  risk: number;
  state: string;
  stage: string;
  stageLabel: string;
  severity: SeverityLevel;
  color: string;
  trend: 'stable' | 'degrading' | 'improving' | string;
  persistenceTicks: number;
  role: 'PRIMARY_FAULT' | 'PRIMARY_SOURCE' | 'DOWNSTREAM_IMPACT' | 'NOMINAL' | string;
  evidence: string[];
  baseline: Record<string, number>;
  current: Record<string, number>;
  deviations: Record<string, number>;
  ratesOfChange: Record<string, number>;
  sensorReliability: {
    score: number;
    isReliable: boolean;
    source: string;
  };
  processImpact: {
    upstream: string;
    currentUnit: string;
    downstream: string;
  };
  lastUpdated: string;
}

export interface EquipmentDiagnosticsMap {
  P101: EquipmentDiagnosticItem;
  E101: EquipmentDiagnosticItem;
  R101: EquipmentDiagnosticItem;
  D101: EquipmentDiagnosticItem;
  pump?: EquipmentDiagnosticItem;
  heat_exchanger?: EquipmentDiagnosticItem;
  reactor?: EquipmentDiagnosticItem;
  distillation?: EquipmentDiagnosticItem;
  plant?: {
    health: number;
    stage: string;
    stageLabel: string;
    severity: SeverityLevel;
    color: string;
    primarySource: string;
    activeUnitsCount: number;
    lastUpdated: string;
  };
}

export interface TimelineEventItem {
  id: number;
  time: string;
  timestamp: string;
  stage: string;
  severity: SeverityLevel;
  equipment: string;
  message: string;
  parameter?: string | null;
  value?: string | number | null;
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
  workflow?: ProcessGraphState;
  controls?: ManualControlOverrides;
  active_alerts?: IntelligentAlert[];
  alert_summary?: AlertSummary;
  alarms?: any[];
  diagnosis: Diagnosis;
  // CONTINUOUS PLANT-WIDE EQUIPMENT ML MONITOR STATE (SINGLE SOURCE OF TRUTH)
  equipment_diagnostics?: EquipmentDiagnosticsMap;
  equipmentDiagnostics?: EquipmentDiagnosticsMap;
  // Continuous Early Fault & Health Data
  process_health?: ProcessHealthData;
  equipment_health?: EquipmentHealthMap;
  early_warnings?: EarlyWarningItem[];
  what_changed?: WhatChangedItem[];
  watch_list?: WatchListItem[];
  causal_propagation?: CausalPropagationData;
  timeline_events?: TimelineEventItem[];
  all_metrics?: Record<string, VariableMetric>;
  // Independent Temporal Intermittent & Transient Fault State
  intermittent_faults?: IntermittentDetectorState;
}

export interface ParameterDeviationRow {
  parameter: string;
  baseline: string;
  current: string;
  deviation: string;
  isAnomaly?: boolean;
}

export interface AutomaticAnalysisItem {
  id: string;
  timestamp: string;
  equipmentId: string;
  equipmentTag?: string;
  equipmentName: string;
  stage: string;
  stageLabel: string;
  severity: SeverityLevel;
  healthScore: number;
  triggerReason: string;
  whatIsHappening: string;
  whyItIsHappening: string;
  evidence: string[];
  trend: string;
  potentialImpact: string;
  whatToVerify: string;
  riskScore: number;
  confidence: number;
  status: 'IDLE' | 'ANALYZING' | 'UPDATED' | 'UNAVAILABLE';
  fullExplanation?: string;
  provider?: string;
  baselineComparison?: string;
  parameterRows?: ParameterDeviationRow[];
  primaryHypothesis?: string;
  supportingEvidence?: string[];
  alternativePossibilities?: string[];
  downstreamImpacts?: Array<{ unitTag: string; unitName?: string; impact: string }>;
  operatorChecklist?: string[];
  primaryFaultTag?: string;
  role?: 'PRIMARY_FAULT' | 'PRIMARY_SOURCE' | 'DOWNSTREAM_IMPACT' | 'NOMINAL' | string;
  isFailureConfirmed?: boolean;
  isUnknownFault?: boolean;
}

export interface FailureEventHistoryItem {
  id: string;
  timestamp: string;
  equipment: string;
  equipmentTag: string;
  equipmentName: string;
  previousState: string;
  newState: string;
  health: number;
  risk: number;
  trigger: string;
  evidence: string[];
  aiStatus: 'TRIGGERED' | 'COMPLETED' | 'FALLBACK_READY' | 'FAILED';
  analysis?: AutomaticAnalysisItem;
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
  fallback?: boolean;
  fallbackNotice?: string;
  evidence?: Array<{ label: string; val: string; state: string }>;
}

export interface ChatResponse {
  success?: boolean;
  text?: string;
  response?: string;
  answer?: string;
  model?: string;
  equipment?: string;
  fallback?: boolean;
  fallbackNotice?: string;
  evidence?: Array<{ label: string; val: string; state: string }>;
  provider?: 'gemini' | 'groq' | 'Gemini' | 'Groq' | 'ai_assistant' | 'local_rule_engine' | 'groq_industrial_ai' | 'industrial_ai' | string;
  timestamp?: string;
  error?: string;
  whatIf?: any;
}

export interface WhatIfImpactNode {
  step: number;
  equipment: string;
  parameter: string;
  from: string;
  to: string;
  direction: 'UP' | 'DOWN' | 'SAME';
  detail: string;
}

export interface WhatIfParamChange {
  parameter: string;
  current: string;
  scenario: string;
  delta: string;
}

export interface WhatIfScenarioSummary {
  equipment: string;
  equipment_name?: string;
  variable: string;
  label: string;
  unit: string;
  hypothetical_value: number;
  mode: string;
  description?: string;
}

export interface WhatIfRiskAssessment {
  currentStage: string;
  currentScore: number;
  scenarioStage: string;
  scenarioScore: number;
  isDangerous: boolean;
  violations?: Array<{
    equipment: string;
    parameter: string;
    severity: string;
    value: any;
    limit: any;
    unit: string;
  }>;
}

export interface WhatIfStateSnapshot {
  pump: PumpData;
  heatExchanger: HeatExchangerData;
  reactor: ReactorData;
  distillation: DistillationData;
  riskScore: number;
  riskStage: string;
}

export interface WhatIfMultiScenarioItem {
  label: string;
  scenario: WhatIfScenarioSummary;
  pumpRpm: number;
  flow: number;
  reactorTemp: number;
  reactorPressure: number;
  distTopTemp: number;
  distPressure: number;
  riskScore: number;
  riskStage: string;
  simulationResult?: any;
}

export interface WhatIfMultiComparison {
  baseline: {
    label: string;
    pumpRpm: number;
    flow: number;
    reactorTemp: number;
    reactorPressure: number;
    distTopTemp: number;
    distPressure: number;
    riskScore: number;
    riskStage: string;
  };
  scenarios: WhatIfMultiScenarioItem[];
}

export interface WhatIfResult {
  success: boolean;
  isMulti?: boolean;
  scenario?: WhatIfScenarioSummary;
  current?: WhatIfStateSnapshot;
  predicted?: WhatIfStateSnapshot;
  changes?: WhatIfParamChange[];
  impactChain?: WhatIfImpactNode[];
  risk?: WhatIfRiskAssessment;
  multiComparison?: WhatIfMultiComparison;
  explanation: string;
  answer?: string;
  response?: string;
  provider?: string;
  timestamp: string;
  error?: string;
}

// SCADA Alarms & Interlocks
export interface ScadaAlarmItem {
  id: number;
  tag: string;
  equipment: string;
  alarm_type: string;
  severity: 'NORMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  value: number;
  threshold: number;
  unit: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'CLEARED';
  triggered_at: string;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  cleared_at?: string | null;
}

export interface InterlockItem {
  id: string;
  name: string;
  equipment: string;
  permissive: boolean;
  status: 'NORMAL' | 'INTERLOCKED' | 'WARNING';
  reason: string;
  monitored_value: number;
  limit_value: number;
  unit: string;
}

export interface EventLogItem {
  id: number;
  timestamp: string;
  event_type: 'ALARM' | 'INTERLOCK' | 'COMMAND' | 'SETPOINT' | 'SYSTEM' | 'MAINTENANCE' | 'FAULT';
  source: string;
  equipment: string;
  message: string;
  severity: 'NORMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details?: any;
}

export interface AuditTrailItem {
  id: number;
  timestamp: string;
  operator: string;
  action: string;
  equipment: string;
  parameter: string;
  previous_value: string;
  new_value: string;
  status: 'SUCCESS' | 'BLOCKED' | 'FAILED';
  reason?: string;
}

export interface MaintenanceItem {
  id: number;
  ticket_id: string;
  equipment: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  created_at: string;
  created_by: string;
  assigned_to?: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolution_notes?: string | null;
}

export interface ProcessHistoryPoint {
  id?: number;
  timestamp: string;
  pump_rpm: number;
  pump_flow: number;
  pump_vibration: number;
  pump_temp_in: number;
  pump_temp_out: number;
  hx_temp_out: number;
  hx_efficiency: number;
  reactor_temp: number;
  reactor_pressure: number;
  reactor_level: number;
  reactor_agitator: number;
  reactor_cooling: number;
  dist_top_temp: number;
  dist_bottom_temp: number;
  dist_pressure: number;
  dist_reflux: number;
}

// ==========================================
// PFD FLOWSHEET, TELEMETRY & SIMULATION TYPES
// ==========================================

export interface ManualControlOverrides {
  pump_rpm?: number;
  suction_restriction?: number;
  discharge_restriction?: number;
  pump_condition?: string;
  heat_exchanger_efficiency?: number;
  fouling_level?: number;
  thermal_condition?: string;
  cooling_status?: number;
  reactor_cooling_flow?: number;
  agitator_speed?: number;
  agitator_speed_rpm?: number;
  reaction_kinetics_mod?: number;
  reflux_ratio?: number;
  reboiler_duty_mod?: number;
  column_pressure_setpoint?: number;
}

export interface TelemetryData {
  active_scenario?: string;
  timestamp?: string;
  overall_health?: {
    health_index?: number;
    overall_status?: 'nominal' | 'warning' | 'critical';
  };
  pump?: PumpData;
  heat_exchanger?: HeatExchangerData;
  reactor?: ReactorData;
  distillation?: DistillationData;
  streams?: ProcessStream[];
}

// ==========================================
// INTERMITTENT & TRANSIENT FAULTS MODULE TYPES
// ==========================================

export type IntermittentPatternType =
  | 'NON-REPEATABLE'
  | 'ISOLATED TRANSIENT'
  | 'ISOLATED'
  | 'SPORADIC'
  | 'INTERMITTENT'
  | 'RECURRENT'
  | 'PERSISTENT'
  | 'UNCLASSIFIED TRANSIENT EVENT'
  | 'NORMAL';

export type IntermittentStatusType = 'EVENT ACTIVE' | 'RECOVERED' | 'TRANSIENT EVENT';

export interface IntermittentVariableDeviation {
  nominal: number;
  current: number;
  delta: number;
  percent: number;
  unit: string;
  normalizedDev: number;
  isAbnormal: boolean;
}

export interface IntermittentVariableBaseline {
  nominal: number;
  unit: string;
  name: string;
}

export interface IntermittentEvent {
  id?: number;
  event_id: string;
  equipment_id: string;
  equipment_name?: string;
  start_time: string;
  end_time: string | null;
  duration: number;
  severity: SeverityLevel;
  pattern: IntermittentPatternType;
  event_type?: IntermittentPatternType;
  variables: string[];
  primary_variables?: string[];
  secondary_variables?: string[];
  correlated_variables?: string[];
  values: Record<string, number>;
  baseline: Record<string, IntermittentVariableBaseline>;
  deviation: Record<string, IntermittentVariableDeviation>;
  status: IntermittentStatusType;
  observation: string;
  interpretation: string;
  time_since_previous?: number | null;
  recurrence_count?: number;
  average_interval?: number | null;
  average_duration?: number;
  snapshot_history?: Array<Record<string, any>>;
  created_at?: string;
  updated_at?: string;
}

export interface IntermittentRecurrenceStats {
  total_events: number;
  active_events: number;
  non_repeatable_events: number;
  isolated_events: number;
  sporadic_events: number;
  intermittent_events: number;
  recurrent_events: number;
  persistent_events: number;
  avg_duration: number;
  min_duration: number;
  max_duration: number;
  avg_interval?: number | null;
  last_event_time: string | null;
  first_event_time: string | null;
  overall_pattern: string;
  by_equipment: Record<string, { count: number; avg_duration: number; avg_interval?: number | null; last_seen: string | null; pattern?: string }>;
}

export interface IntermittentDetectorState {
  timestamp: string;
  active_events_count: number;
  active_events: IntermittentEvent[];
  recent_events: IntermittentEvent[];
  recurrence_stats: IntermittentRecurrenceStats;
  sliding_window: Array<Record<string, any>>;
  equipment_states: Record<string, { state: string; has_active_event: boolean }>;
}




