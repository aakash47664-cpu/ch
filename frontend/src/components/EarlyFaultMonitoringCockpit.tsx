import React, { useState, useEffect, useMemo } from 'react';
import {
  ProcessUpdatePayload,
  EquipmentHealthMap,
  EquipmentHealthItem,
  TimeSeriesPoint
} from '../types';
import {
  Activity,
  Flame,
  Atom,
  Layers,
  Sparkles,
  Clock,
  Eye,
  GitBranch,
  BarChart2,
  RotateCcw
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { useAutomaticProblemAnalysis } from '../hooks/useAutomaticProblemAnalysis';
import { AutomaticAnalysisPanel } from './AutomaticAnalysisPanel';
import { useLiveEquipmentAiAnalysis } from '../hooks/useLiveEquipmentAiAnalysis';
import { LiveEquipmentAiAnalysisCard } from './LiveEquipmentAiAnalysisCard';

interface EarlyFaultMonitoringCockpitProps {
  state: ProcessUpdatePayload;
  timeSeries: TimeSeriesPoint[];
  selectedEquipment: string;
  onSelectEquipment: (equipmentId: string) => void;
  onAskAiAboutEquipment: (equipmentId: string) => void;
}

type MetricKey =
  | 'vibration'
  | 'rpm'
  | 'flow'
  | 'deltaT'
  | 'efficiency'
  | 'outletTemp'
  | 'reactorTemp'
  | 'reactorPressure'
  | 'agitator'
  | 'distReflux'
  | 'distTopTemp'
  | 'distPressure';

export const EarlyFaultMonitoringCockpit: React.FC<EarlyFaultMonitoringCockpitProps> = ({
  state,
  timeSeries,
  selectedEquipment,
  onSelectEquipment,
  onAskAiAboutEquipment
}) => {
  // Automatic Problem Analysis Engine (Event-Driven AI Diagnostician)
  const {
    currentAnalysis,
    recentAnalyses,
    failureHistory,
    isAnalyzing,
    lastAnalysisTime,
    aiError
  } = useAutomaticProblemAnalysis(state);

  // Operator-Triggered Real-Time Live Equipment AI Analysis Engine
  const {
    analysisMap,
    isAnalyzing: isLiveAiAnalyzing,
    error: liveAiError,
    activeAnalysisEquipment,
    analyzeEquipment
  } = useLiveEquipmentAiAnalysis(state);

  // Live ticker for time since last update
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  useEffect(() => {
    setSecondsAgo(0);
    const timer = setInterval(() => {
      setSecondsAgo((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [state.timestamp]);

  const isStale = secondsAgo > 5;

  // Equipment definition map
  const equipmentUnits = [
    {
      id: 'pump',
      key: 'pump' as keyof EquipmentHealthMap,
      tag: 'P-101',
      name: 'Feed Pump',
      fullName: 'P-101 — Centrifugal Feed Pump',
      icon: <Activity size={16} />,
      color: '#EA580C'
    },
    {
      id: 'heat_exchanger',
      key: 'heat_exchanger' as keyof EquipmentHealthMap,
      tag: 'E-101',
      name: 'Heat Exchanger',
      fullName: 'E-101 — Shell & Tube Exchanger',
      icon: <Flame size={16} />,
      color: '#0891B2'
    },
    {
      id: 'reactor',
      key: 'reactor' as keyof EquipmentHealthMap,
      tag: 'R-101',
      name: 'CSTR Reactor',
      fullName: 'R-101 — Exothermic CSTR Reactor',
      icon: <Atom size={16} />,
      color: '#7C3AED'
    },
    {
      id: 'distillation',
      key: 'distillation' as keyof EquipmentHealthMap,
      tag: 'D-101',
      name: 'Distillation Column',
      fullName: 'D-101 — Binary Distillation Fractionator',
      icon: <Layers size={16} />,
      color: '#2563EB'
    }
  ];

  // Auto-sort equipment list by degradation (worst health score first)
  const rankedEquipment = useMemo(() => {
    return equipmentUnits
      .map((unit) => {
        const item = state.equipment_health?.[unit.key];
        const health = item?.health ?? 100;
        const stage = item?.stage ?? 'NORMAL';
        const label = item?.label ?? 'HEALTHY';
        return {
          ...unit,
          health,
          stage,
          label,
          item
        };
      })
      .sort((a, b) => a.health - b.health);
  }, [state.equipment_health]);

  // Selected equipment data
  const currentUnit = equipmentUnits.find((u) => u.id === selectedEquipment) || equipmentUnits[0];
  const currentHealthItem: Partial<EquipmentHealthItem> =
    state.equipment_health?.[currentUnit.key] || {
      id: currentUnit.id,
      equipment: currentUnit.tag,
      name: currentUnit.fullName,
      health: 100,
      stage: 'NORMAL',
      label: 'HEALTHY',
      color: '#16A34A',
      severity: 'NORMAL'
    };

  const currentScore = currentHealthItem.health ?? 100;
  const currentStage = currentHealthItem.stage ?? 'NORMAL';

  // Derive automatic analysis for selected equipment if available
  const autoAnalysisForThisUnit =
    currentAnalysis && currentAnalysis.equipmentId === selectedEquipment
      ? {
          equipmentId: currentAnalysis.equipmentId,
          equipmentTag: currentUnit.tag,
          equipmentName: currentUnit.fullName,
          timestamp: currentAnalysis.timestamp,
          healthScore: currentAnalysis.healthScore,
          stage: currentAnalysis.stage,
          riskScore: currentAnalysis.riskScore,
          provider: currentAnalysis.provider || 'Gemini',
          model: 'gemini-2.5-flash',
          rawText: currentAnalysis.fullExplanation || '',
          sections: {
            whatIsHappening: currentAnalysis.whatIsHappening,
            keyEvidence: currentAnalysis.evidence,
            likelyCause: currentAnalysis.whyItIsHappening,
            alternativePossibilities: currentAnalysis.alternativePossibilities || [],
            processImpact: currentAnalysis.potentialImpact,
            whatToVerify: Array.isArray(currentAnalysis.whatToVerify)
              ? currentAnalysis.whatToVerify
              : currentAnalysis.whatToVerify
              ? [currentAnalysis.whatToVerify]
              : [],
            riskAssessment: `Risk Score: ${currentAnalysis.riskScore}/100 (${currentAnalysis.severity})`
          }
        }
      : null;

  // Live AI Analysis State for current selected equipment
  const currentAnalysisResult = analysisMap[selectedEquipment] || autoAnalysisForThisUnit;
  const isThisEquipmentAnalyzing = isLiveAiAnalyzing && activeAnalysisEquipment === selectedEquipment;

  // Selected chart metric tab
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('vibration');

  // Reset selected metric when switching equipment
  useEffect(() => {
    if (selectedEquipment === 'pump') setSelectedMetric('vibration');
    else if (selectedEquipment === 'heat_exchanger') setSelectedMetric('deltaT');
    else if (selectedEquipment === 'reactor') setSelectedMetric('reactorTemp');
    else if (selectedEquipment === 'distillation') setSelectedMetric('distReflux');
  }, [selectedEquipment]);

  // Chart configuration for selected metric
  const chartConfigs: Record<
    string,
    Array<{ key: MetricKey; label: string; dataKey: keyof TimeSeriesPoint; unit: string; color: string; baseline: number }>
  > = {
    pump: [
      { key: 'vibration', label: 'Vibration', dataKey: 'pumpVibration', unit: 'g', color: '#DC2626', baseline: 0.08 },
      { key: 'rpm', label: 'RPM', dataKey: 'pumpRpm', unit: 'RPM', color: '#2563EB', baseline: 2450 },
      { key: 'flow', label: 'Flow', dataKey: 'pumpFlow', unit: 'L/min', color: '#0891B2', baseline: 10.0 }
    ],
    heat_exchanger: [
      { key: 'deltaT', label: 'ΔT Gradient', dataKey: 'hxDeltaT', unit: '°C', color: '#0891B2', baseline: 12.9 },
      { key: 'outletTemp', label: 'Outlet Temp', dataKey: 'hxOutletTemp', unit: '°C', color: '#EA580C', baseline: 25.2 }
    ],
    reactor: [
      { key: 'reactorTemp', label: 'Core Temp', dataKey: 'reactorTemp', unit: '°C', color: '#DC2626', baseline: 65.0 },
      { key: 'reactorPressure', label: 'Pressure', dataKey: 'reactorPressure', unit: 'bar', color: '#7C3AED', baseline: 2.05 }
    ],
    distillation: [
      { key: 'distReflux', label: 'Reflux Ratio', dataKey: 'distReflux', unit: '', color: '#2563EB', baseline: 1.85 },
      { key: 'distTopTemp', label: 'Top Temp', dataKey: 'distTopTemp', unit: '°C', color: '#EA580C', baseline: 76.5 }
    ]
  };

  const activeChartOptions = chartConfigs[selectedEquipment] || chartConfigs.pump;
  const currentChartMetric =
    activeChartOptions.find((opt) => opt.key === selectedMetric) || activeChartOptions[0];

  // Helper for trend arrow formatting
  const renderTrend = (trend?: string, delta?: number) => {
    if (trend === 'increasing' || (delta !== undefined && delta > 0.5)) {
      return <span className="trend-badge-up" title="Trending Upward">↑</span>;
    }
    if (trend === 'decreasing' || (delta !== undefined && delta < -0.5)) {
      return <span className="trend-badge-down" title="Trending Downward">↓</span>;
    }
    return <span className="trend-badge-stable" title="Stable">→</span>;
  };

  // Helper for Stage Pill class
  const getStageClass = (stage?: string) => {
    switch (stage?.toUpperCase()) {
      case 'NORMAL':
        return 'stage-pill-healthy';
      case 'EARLY_DEVIATION':
        return 'stage-pill-deviation';
      case 'EARLY_DEGRADATION':
        return 'stage-pill-early';
      case 'DEVELOPING_FAULT':
      case 'DEVELOPING':
        return 'stage-pill-developing';
      case 'HIGH_RISK':
        return 'stage-pill-highrisk';
      case 'FAULT_CONFIRMED':
      case 'FAULT':
      case 'CRITICAL':
        return 'stage-pill-fault';
      default:
        return 'stage-pill-healthy';
    }
  };

  const getStageLabel = (stage?: string) => {
    switch (stage?.toUpperCase()) {
      case 'NORMAL':
        return '🟢 HEALTHY';
      case 'EARLY_DEVIATION':
        return '🟡 EARLY DEVIATION';
      case 'EARLY_DEGRADATION':
        return '🟠 EARLY DEGRADATION';
      case 'DEVELOPING_FAULT':
      case 'DEVELOPING':
        return '🔴 DEVELOPING';
      case 'HIGH_RISK':
        return '🔴 HIGH RISK';
      case 'FAULT_CONFIRMED':
      case 'FAULT':
        return '🔴 FAULT';
      default:
        return '🟢 HEALTHY';
    }
  };

  // 6-stage linear progression timeline stages
  const progressionStages = [
    { key: 'NORMAL', label: 'NORMAL', isPassed: true },
    { key: 'EARLY_DEVIATION', label: 'EARLY DEVIATION', isPassed: currentScore < 90 },
    { key: 'EARLY_DEGRADATION', label: 'EARLY DEGRADATION', isPassed: currentScore < 75 },
    { key: 'DEVELOPING_FAULT', label: 'DEVELOPING', isPassed: currentScore < 60 },
    { key: 'HIGH_RISK', label: 'HIGH RISK', isPassed: currentScore < 45 },
    { key: 'FAULT_CONFIRMED', label: 'FAULT', isPassed: currentScore < 25 }
  ];

  // Helper to determine the current step in the 6-stage progression
  const getCurrentProgressionKey = (stage?: string, score: number = 100): string => {
    if (stage === 'FAULT_CONFIRMED' || score < 25) return 'FAULT_CONFIRMED';
    if (stage === 'HIGH_RISK' || score < 45) return 'HIGH_RISK';
    if (stage === 'DEVELOPING_FAULT' || score < 60) return 'DEVELOPING_FAULT';
    if (stage === 'EARLY_DEGRADATION' || score < 75) return 'EARLY_DEGRADATION';
    if (stage === 'EARLY_DEVIATION' || score < 90) return 'EARLY_DEVIATION';
    return 'NORMAL';
  };

  const activeProgressionKey = getCurrentProgressionKey(currentStage, currentScore);

  // Derive "Why is this happening?" evidence items for selected equipment
  const getWhyEvidence = () => {
    if (selectedEquipment === 'pump') {
      const vib = state.equipment.pump.data.vibration || 0.08;
      const rpm = state.equipment.pump.data.rpm || 2450;
      const flow = state.equipment.pump.data.flow || 10.0;
      const vibDelta = (((vib - 0.08) / 0.08) * 100).toFixed(1);
      const rpmDelta = (((rpm - 2450) / 2450) * 100).toFixed(1);
      const flowDelta = (((flow - 10.0) / 10.0) * 100).toFixed(1);

      if (vib > 0.12 || rpm < 2400) {
        return {
          reasons: [
            vib > 0.12 ? `Casing vibration magnitude elevated (${vib.toFixed(2)} g)` : 'Vibration within nominal boundary',
            rpm < 2400 ? `Rotational speed slipping (${Math.round(rpm)} RPM)` : 'Rotational speed maintained',
            flow < 9.5 ? `Hydraulic discharge flow decaying (${flow.toFixed(1)} L/min)` : 'Discharge flow normal'
          ],
          evidence: [
            { label: 'Vibration', val: `${Number(vibDelta) > 0 ? '+' : ''}${vibDelta}%` },
            { label: 'RPM', val: `${Number(rpmDelta) > 0 ? '+' : ''}${rpmDelta}%` },
            { label: 'Flow', val: `${Number(flowDelta) > 0 ? '+' : ''}${flowDelta}%` }
          ]
        };
      }
      return {
        reasons: ['✓ Rotational speed stable (2450 RPM)', '✓ Vibration baseline nominal (0.08 g)', '✓ Discharge flow 10.0 L/min within design envelope'],
        evidence: [{ label: 'Vibration', val: '0.0%' }, { label: 'RPM', val: '0.0%' }, { label: 'Flow', val: '0.0%' }]
      };
    }

    if (selectedEquipment === 'heat_exchanger') {
      const dt = state.equipment.heat_exchanger.data.temperature_difference || 12.9;
      const eff = state.equipment.heat_exchanger.data.efficiency ?? state.equipment.heat_exchanger.data.heat_transfer_indicator ?? 95.0;
      const outT = state.equipment.heat_exchanger.data.outlet_temperature || 38.1;
      const dtDelta = (((dt - 12.9) / 12.9) * 100).toFixed(1);
      const effDelta = (((eff - 95.0) / 95.0) * 100).toFixed(1);

      if (dt < 10.5 || eff < 88.0) {
        return {
          reasons: [
            dt < 10.5 ? `Thermal gradient ΔT decaying (${dt.toFixed(1)} °C)` : 'Thermal gradient nominal',
            eff < 88.0 ? `Heat transfer efficiency loss (${eff.toFixed(0)}%)` : 'Efficiency acceptable',
            `Cooling effluent temperature at ${outT.toFixed(1)} °C`
          ],
          evidence: [
            { label: 'ΔT Gradient', val: `${Number(dtDelta) > 0 ? '+' : ''}${dtDelta}%` },
            { label: 'Efficiency', val: `${Number(effDelta) > 0 ? '+' : ''}${effDelta}%` }
          ]
        };
      }
      return {
        reasons: ['✓ Thermal gradient ΔT nominal (12.9 °C)', '✓ Tube fouling resistance zero', '✓ Heat transfer efficiency 95.0%'],
        evidence: [{ label: 'ΔT Gradient', val: '0.0%' }, { label: 'Efficiency', val: '0.0%' }]
      };
    }

    if (selectedEquipment === 'reactor') {
      const temp = state.equipment.reactor.data.temperature || 65.0;
      const press = state.equipment.reactor.data.pressure || 2.05;
      const cooling = state.equipment.reactor.data.cooling_status;
      const tempDelta = (((temp - 65.0) / 65.0) * 100).toFixed(1);
      const pressDelta = (((press - 2.05) / 2.05) * 100).toFixed(1);

      if (temp > 68.0 || cooling === 0 || press > 2.25) {
        return {
          reasons: [
            temp > 68.0 ? `Core reaction temperature escalating (${temp.toFixed(1)} °C)` : 'Temperature nominal',
            cooling === 0 ? 'Cooling jacket interlock tripped / uncirculated' : 'Cooling jacket active',
            press > 2.25 ? `Internal vapor pressure accumulating (${press.toFixed(2)} bar)` : 'Vapor pressure nominal'
          ],
          evidence: [
            { label: 'Core Temp', val: `${Number(tempDelta) > 0 ? '+' : ''}${tempDelta}%` },
            { label: 'Pressure', val: `${Number(pressDelta) > 0 ? '+' : ''}${pressDelta}%` },
            { label: 'Cooling', val: cooling === 1 ? 'ACTIVE' : 'TRIPPED' }
          ]
        };
      }
      return {
        reasons: ['✓ Exothermic reaction heat balanced at 65.0 °C', '✓ Jacket cooling circulation active', '✓ Internal pressure 2.05 bar nominal'],
        evidence: [{ label: 'Core Temp', val: '0.0%' }, { label: 'Pressure', val: '0.0%' }]
      };
    }

    if (selectedEquipment === 'distillation') {
      const reflux = state.equipment.distillation.data.reflux_ratio || 1.85;
      const topT = state.equipment.distillation.data.top_temperature || 76.5;
      const press = state.equipment.distillation.data.pressure || 2.10;
      const refluxDelta = (((reflux - 1.85) / 1.85) * 100).toFixed(1);
      const topTDelta = (((topT - 76.5) / 76.5) * 100).toFixed(1);

      if (reflux < 1.65 || topT > 79.5) {
        return {
          reasons: [
            reflux < 1.65 ? `Reflux ratio (L/D) slipping (${reflux.toFixed(2)})` : 'Reflux ratio nominal',
            topT > 79.5 ? `Overhead vapor temperature rising (${topT.toFixed(1)} °C)` : 'Top vapor temperature normal',
            `Column operating pressure at ${press.toFixed(2)} bar`
          ],
          evidence: [
            { label: 'Reflux (L/D)', val: `${Number(refluxDelta) > 0 ? '+' : ''}${refluxDelta}%` },
            { label: 'Top Temp', val: `${Number(topTDelta) > 0 ? '+' : ''}${topTDelta}%` }
          ]
        };
      }
      return {
        reasons: ['✓ Reflux ratio nominal at 1.85 L/D', '✓ Binary tray vapor-liquid equilibrium steady', '✓ Overhead distillate purity on-spec'],
        evidence: [{ label: 'Reflux (L/D)', val: '0.0%' }, { label: 'Top Temp', val: '0.0%' }]
      };
    }

    return { reasons: ['Operating within baseline design tolerances'], evidence: [] };
  };

  const whyEvidence = getWhyEvidence();

  // Downstream Process Impact Matrix
  const getDownstreamImpact = () => {
    switch (selectedEquipment) {
      case 'pump': {
        const isFlowDegraded = (state.equipment.pump.data.flow || 10.0) < 8.5;
        return [
          { tag: 'E-101', name: 'Heat Exchanger', status: isFlowDegraded ? 'affected' : 'monitoring', desc: isFlowDegraded ? 'Inlet feed flow reduced; heat duty decaying' : 'Flowrate within normal envelope' },
          { tag: 'R-101', name: 'CSTR Reactor', status: isFlowDegraded ? 'affected' : 'monitoring', desc: isFlowDegraded ? 'Reactant feed volumetric rate reduced; residence time extending' : 'Feed delivery nominal' },
          { tag: 'D-101', name: 'Distillation', status: isFlowDegraded ? 'affected' : 'monitoring', desc: isFlowDegraded ? 'Column feed hydraulic stability monitoring' : 'Feed flow steady' }
        ];
      }
      case 'heat_exchanger': {
        const isThermalFouling = (state.equipment.heat_exchanger.data.temperature_difference || 12.9) < 8.0;
        return [
          { tag: 'R-101', name: 'CSTR Reactor', status: isThermalFouling ? 'affected' : 'monitoring', desc: isThermalFouling ? 'Warm feed entering reactor (+4.5°C above baseline)' : 'Inlet temperature conditioned' },
          { tag: 'D-101', name: 'Distillation', status: 'monitoring', desc: 'Downstream column thermal load tracking' }
        ];
      }
      case 'reactor': {
        const isRunaway = (state.equipment.reactor.data.temperature || 65.0) > 75.0 || state.equipment.reactor.data.cooling_status === 0;
        return [
          { tag: 'D-101', name: 'Distillation', status: isRunaway ? 'affected' : 'monitoring', desc: isRunaway ? 'Overheated liquid stream entering distillation feed tray' : 'Feed enthalpy nominal' },
          { tag: 'Relief', name: 'Vessel Vent', status: isRunaway ? 'affected' : 'monitoring', desc: isRunaway ? 'Approaching overpressure interlock threshold' : 'Pressure within safety boundary' }
        ];
      }
      case 'distillation': {
        const isRefluxLost = (state.equipment.distillation.data.reflux_ratio || 1.85) < 1.30;
        return [
          { tag: 'Overhead', name: 'Distillate Product', status: isRefluxLost ? 'affected' : 'monitoring', desc: isRefluxLost ? 'Product purity loss; heavy components carrying overhead' : 'Overhead purity on-spec' },
          { tag: 'Bottoms', name: 'Reboiler Waste', status: isRefluxLost ? 'affected' : 'monitoring', desc: isRefluxLost ? 'Bottoms composition shift' : 'Bottoms separation nominal' }
        ];
      }
      default:
        return [];
    }
  };

  const downstreamImpacts = getDownstreamImpact();

  // Baseline Comparison Rows for Selected Equipment
  const getBaselineComparisonRows = () => {
    if (selectedEquipment === 'pump') {
      const p = state.equipment.pump.data;
      return [
        { name: 'Rotational Speed', baseline: '2450 RPM', current: `${Math.round(p.rpm || 2450)} RPM`, delta: (p.rpm - 2450) / 2450, trend: p.rpm < 2400 ? 'decreasing' : 'stable' },
        { name: 'Casing Vibration', baseline: '0.08 g', current: `${(p.vibration || 0.08).toFixed(2)} g`, delta: (p.vibration - 0.08) / 0.08, trend: p.vibration > 0.12 ? 'increasing' : 'stable' },
        { name: 'Discharge Flow', baseline: '10.0 L/min', current: `${(p.flow || 10.0).toFixed(1)} L/min`, delta: ((p.flow || 10.0) - 10.0) / 10.0, trend: (p.flow || 10.0) < 9.5 ? 'decreasing' : 'stable' },
        { name: 'Discharge Pressure', baseline: '2.80 bar', current: `${(p.pressure || 2.80).toFixed(2)} bar`, delta: ((p.pressure || 2.80) - 2.80) / 2.80, trend: 'stable' },
        { name: 'Inlet Temp', baseline: '25.2 °C', current: `${(p.inlet_temperature || 25.2).toFixed(1)} °C`, delta: 0, trend: 'stable' }
      ];
    }

    if (selectedEquipment === 'heat_exchanger') {
      const hx = state.equipment.heat_exchanger.data;
      const eff = hx.efficiency ?? hx.heat_transfer_indicator ?? 95.0;
      return [
        { name: 'Thermal Gradient (ΔT)', baseline: '12.9 °C', current: `${(hx.temperature_difference || 12.9).toFixed(1)} °C`, delta: (hx.temperature_difference - 12.9) / 12.9, trend: hx.temperature_difference < 10.5 ? 'decreasing' : 'stable' },
        { name: 'Heat Transfer Eff.', baseline: '95.0 %', current: `${eff.toFixed(1)} %`, delta: (eff - 95.0) / 95.0, trend: eff < 88.0 ? 'decreasing' : 'stable' },
        { name: 'Inlet Temp', baseline: '38.1 °C', current: `${(hx.inlet_temperature || 38.1).toFixed(1)} °C`, delta: ((hx.inlet_temperature || 38.1) - 38.1) / 38.1, trend: 'stable' },
        { name: 'Outlet Temp', baseline: '25.2 °C', current: `${(hx.outlet_temperature || 25.2).toFixed(1)} °C`, delta: ((hx.outlet_temperature || 25.2) - 25.2) / 25.2, trend: hx.outlet_temperature > 28.0 ? 'increasing' : 'stable' }
      ];
    }

    if (selectedEquipment === 'reactor') {
      const rx = state.equipment.reactor.data;
      return [
        { name: 'Core Temperature', baseline: '65.0 °C', current: `${(rx.temperature || 65.0).toFixed(1)} °C`, delta: (rx.temperature - 65.0) / 65.0, trend: rx.temperature > 68.0 ? 'increasing' : 'stable' },
        { name: 'Vessel Pressure', baseline: '2.05 bar', current: `${(rx.pressure || 2.05).toFixed(2)} bar`, delta: (rx.pressure - 2.05) / 2.05, trend: rx.pressure > 2.25 ? 'increasing' : 'stable' },
        { name: 'Liquid Holdup Level', baseline: '50.0 %', current: `${(rx.level || 50.0).toFixed(1)} %`, delta: ((rx.level || 50.0) - 50.0) / 50.0, trend: 'stable' },
        { name: 'Agitator Speed', baseline: '350 RPM', current: `${Math.round(rx.agitator_speed || 350)} RPM`, delta: ((rx.agitator_speed || 350) - 350) / 350, trend: 'stable' },
        { name: 'Cooling Jacket Status', baseline: 'ACTIVE (1)', current: rx.cooling_status === 1 ? 'ACTIVE (1)' : 'TRIPPED (0)', delta: rx.cooling_status === 1 ? 0 : -1, trend: rx.cooling_status === 1 ? 'stable' : 'decreasing' }
      ];
    }

    if (selectedEquipment === 'distillation') {
      const dist = state.equipment.distillation.data;
      return [
        { name: 'Reflux Ratio (L/D)', baseline: '1.85', current: `${(dist.reflux_ratio || 1.85).toFixed(2)}`, delta: (dist.reflux_ratio - 1.85) / 1.85, trend: dist.reflux_ratio < 1.65 ? 'decreasing' : 'stable' },
        { name: 'Top Vapor Temp', baseline: '76.5 °C', current: `${(dist.top_temperature || 76.5).toFixed(1)} °C`, delta: (dist.top_temperature - 76.5) / 76.5, trend: dist.top_temperature > 79.5 ? 'increasing' : 'stable' },
        { name: 'Bottom Temp', baseline: '98.4 °C', current: `${(dist.bottom_temperature || 98.4).toFixed(1)} °C`, delta: ((dist.bottom_temperature || 98.4) - 98.4) / 98.4, trend: 'stable' },
        { name: 'Column Pressure', baseline: '2.10 bar', current: `${(dist.pressure || 2.10).toFixed(2)} bar`, delta: ((dist.pressure || 2.10) - 2.10) / 2.10, trend: 'stable' }
      ];
    }

    return [];
  };

  const baselineRows = getBaselineComparisonRows();

  // Overall Process Health Score from backend
  const overallHealth = state.process_health?.score ?? 95;
  const overallStage = state.process_health?.stage ?? 'NORMAL';

  return (
    <div className="ef-cockpit-container" aria-label="Continuous Early Fault Monitoring Cockpit">
      {/* ===================================================
          1. TOP LIVE STATUS & PROCESS HEALTH BAR
          =================================================== */}
      <div className="ef-cockpit-header">
        <div className="ef-header-left">
          {/* Live Heartbeat Indicator */}
          <div className="ef-live-indicator">
            <span className={`ef-live-dot ${isStale ? 'stale' : 'pulsing'}`} />
            <span className="ef-live-text">{isStale ? '● DATA STALE' : '● LIVE MONITORING'}</span>
            <span className="ef-live-timer">
              <Clock size={11} /> {secondsAgo === 0 ? 'Just now' : `${secondsAgo}s ago`}
            </span>
          </div>

          <div className="ef-header-divider" />

          {/* Overall Process Health Ring & Stage */}
          <div className="ef-overall-health-box">
            <div className="ef-gauge-mini">
              <svg className="ef-gauge-svg" viewBox="0 0 36 36">
                <path
                  className="ef-gauge-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="ef-gauge-fill"
                  strokeDasharray={`${overallHealth}, 100`}
                  stroke={overallHealth >= 85 ? '#16A34A' : overallHealth >= 60 ? '#EA580C' : '#DC2626'}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="ef-gauge-score">{overallHealth}%</span>
            </div>
            <div>
              <div className="ef-overall-title">OVERALL PROCESS HEALTH</div>
              <span className={`ef-stage-badge ${getStageClass(overallStage)}`}>
                {getStageLabel(overallStage)}
              </span>
            </div>
          </div>
        </div>

        {/* Auto-Sorted "Equipment to Watch" Ranking */}
        <div className="ef-header-right">
          <div className="ef-watchlist-strip">
            <div className="ef-watchlist-title">
              <Eye size={12} color="var(--primary-blue)" />
              <span>EQUIPMENT TO WATCH:</span>
            </div>
            <div className="ef-watchlist-pills">
              {rankedEquipment.map((unit, idx) => {
                const isSelected = selectedEquipment === unit.id;
                return (
                  <button
                    key={unit.id}
                    className={`ef-watch-pill ${isSelected ? 'active' : ''} ${unit.health < 45 ? 'critical' : unit.health < 75 ? 'early' : 'nominal'}`}
                    onClick={() => onSelectEquipment(unit.id)}
                    title={`Click to focus detailed monitoring on ${unit.tag}`}
                  >
                    <span className="ef-watch-rank">{idx + 1}.</span>
                    <strong>{unit.tag}</strong>
                    <span className="ef-watch-score">{unit.health}%</span>
                    <span className="ef-watch-status">{getStageLabel(unit.stage).split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================
          2. EQUIPMENT MONITORING STRIP (4 COMPACT CARDS)
          =================================================== */}
      <div className="ef-cards-strip">
        {equipmentUnits.map((unit) => {
          const item = state.equipment_health?.[unit.key];
          const score = item?.health ?? 100;
          const stage = item?.stage ?? 'NORMAL';
          const isSelected = selectedEquipment === unit.id;

          // Compute 2 primary live variables per card
          let var1Label = 'RPM';
          let var1Val = `${Math.round(state.equipment.pump.data.rpm || 2450)}`;
          let var1Trend = state.equipment.pump.data.rpm < 2400 ? 'decreasing' : 'stable';

          let var2Label = 'Vibration';
          let var2Val = `${(state.equipment.pump.data.vibration || 0.08).toFixed(2)} g`;
          let var2Trend = state.equipment.pump.data.vibration > 0.12 ? 'increasing' : 'stable';

          if (unit.id === 'heat_exchanger') {
            const hx = state.equipment.heat_exchanger.data;
            var1Label = 'ΔT';
            var1Val = `${(hx.temperature_difference || 12.9).toFixed(1)} °C`;
            var1Trend = hx.temperature_difference < 10.5 ? 'decreasing' : 'stable';

            var2Label = 'Efficiency';
            const eff = hx.efficiency ?? hx.heat_transfer_indicator ?? 95.0;
            var2Val = `${eff.toFixed(0)}%`;
            var2Trend = eff < 88.0 ? 'decreasing' : 'stable';
          } else if (unit.id === 'reactor') {
            const rx = state.equipment.reactor.data;
            var1Label = 'Temperature';
            var1Val = `${(rx.temperature || 65.0).toFixed(1)} °C`;
            var1Trend = rx.temperature > 68.0 ? 'increasing' : 'stable';

            var2Label = 'Pressure';
            var2Val = `${(rx.pressure || 2.05).toFixed(2)} bar`;
            var2Trend = rx.pressure > 2.25 ? 'increasing' : 'stable';
          } else if (unit.id === 'distillation') {
            const dist = state.equipment.distillation.data;
            var1Label = 'Reflux';
            var1Val = `${(dist.reflux_ratio || 1.85).toFixed(2)}`;
            var1Trend = dist.reflux_ratio < 1.65 ? 'decreasing' : 'stable';

            var2Label = 'Top Temp';
            var2Val = `${(dist.top_temperature || 76.5).toFixed(1)} °C`;
            var2Trend = dist.top_temperature > 79.5 ? 'increasing' : 'stable';
          }

          return (
            <div
              key={unit.id}
              className={`ef-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectEquipment(unit.id)}
              role="button"
              tabIndex={0}
              title={`Click to inspect ${unit.tag}`}
            >
              {/* Card Top Row: Tag, Icon, Score */}
              <div className="ef-card-top">
                <div className="ef-card-tag-group">
                  <div className="ef-card-icon" style={{ color: unit.color }}>
                    {unit.icon}
                  </div>
                  <div>
                    <div className="ef-card-tag">{unit.tag}</div>
                    <div className="ef-card-name">{unit.name}</div>
                  </div>
                </div>

                <div className="ef-card-score-box">
                  <span
                    className="ef-card-score-num"
                    style={{
                      color: score >= 85 ? '#16A34A' : score >= 60 ? '#EA580C' : '#DC2626'
                    }}
                  >
                    {score}%
                  </span>
                  <span className="ef-card-score-lbl">HEALTH</span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="ef-card-badge-row">
                <span className={`ef-card-stage-pill ${getStageClass(stage)}`}>
                  {getStageLabel(stage)}
                </span>
                {isSelected && <span className="ef-selected-tag">ACTIVE FOCUS</span>}
              </div>

              {/* 2 Primary Monitored Variables with Trend */}
              <div className="ef-card-vars-box">
                <div className="ef-var-chip">
                  <span className="ef-var-lbl">{var1Label}</span>
                  <span className="ef-var-num">
                    {var1Val} {renderTrend(var1Trend)}
                  </span>
                </div>
                <div className="ef-var-chip">
                  <span className="ef-var-lbl">{var2Label}</span>
                  <span className="ef-var-num">
                    {var2Val} {renderTrend(var2Trend)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===================================================
          2.5 AUTOMATIC FAILURE & CONTINUOUS PROBLEM ANALYSIS PANEL
          =================================================== */}
      <AutomaticAnalysisPanel
        currentAnalysis={currentAnalysis}
        recentAnalyses={recentAnalyses}
        failureHistory={failureHistory}
        isAnalyzing={isAnalyzing}
        lastAnalysisTime={lastAnalysisTime}
        aiError={aiError}
        onManualReanalyze={(equipId) => {
          analyzeEquipment(equipId);
        }}
        onAskAiFollowUp={(equipId, _initialQuestion) => {
          onAskAiAboutEquipment(equipId);
        }}
      />

      {/* ===================================================
          3. SELECTED EQUIPMENT DEEP-DIVE COCKPIT
          =================================================== */}
      <div className="ef-detail-pane">
        {/* Subheader with Action */}
        <div className="ef-detail-subhead">
          <div className="ef-detail-title-group">
            <div className="ef-detail-icon" style={{ color: currentUnit.color }}>
              {currentUnit.icon}
            </div>
            <div>
              <div className="ef-detail-tag-row">
                <span className="ef-detail-tag">{currentUnit.tag}</span>
                <h3 className="ef-detail-title">{currentUnit.fullName}</h3>
                <span className={`ef-card-stage-pill ${getStageClass(currentStage)}`}>
                  {getStageLabel(currentStage)} ({currentScore}% Health)
                </span>
              </div>
              <div className="ef-detail-subtitle">
                Continuous multivariable degradation & baseline tracking (1-Second Sync)
              </div>
            </div>
          </div>

          <button
            className={`ef-ai-btn ${isThisEquipmentAnalyzing ? 'analyzing' : currentAnalysisResult ? 'completed' : ''}`}
            onClick={() => analyzeEquipment(selectedEquipment)}
            disabled={isLiveAiAnalyzing}
            title={`Ask ChemDiag AI to perform live root-cause reasoning on ${currentUnit.tag} using real telemetry`}
          >
            {isThisEquipmentAnalyzing ? (
              <>
                <RotateCcw size={13} className="animate-spin" />
                <span>ANALYZING...</span>
              </>
            ) : currentAnalysisResult ? (
              <>
                <Sparkles size={13} />
                <span>✓ ANALYSIS COMPLETE</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>ANALYZE WITH AI</span>
              </>
            )}
          </button>
        </div>

        {/* 5. EARLY WARNING TIMELINE (VISUAL PROGRESSION BAR) */}
        <div className="ef-timeline-box">
          <div className="ef-timeline-header">
            <span className="ef-timeline-title">EARLY FAULT PROGRESSION TRACKER</span>
            <span className="ef-timeline-hint">Detects parameter degradation before confirmed boundary trip</span>
          </div>

          <div className="ef-timeline-track">
            {progressionStages.map((stg, idx) => {
              const isCurrent = stg.key === activeProgressionKey;
              const isPassed = stg.isPassed;

              return (
                <div
                  key={stg.key}
                  className={`ef-step-node ${isPassed ? 'passed' : ''} ${isCurrent ? 'current' : ''}`}
                >
                  <div className="ef-step-bullet">
                    {isCurrent ? (
                      <span className="ef-step-dot current" />
                    ) : isPassed ? (
                      <span className="ef-step-dot passed" />
                    ) : (
                      <span className="ef-step-dot future" />
                    )}
                  </div>
                  <span className="ef-step-label">{stg.label}</span>
                  {isCurrent && <span className="ef-current-marker">▲ CURRENT</span>}
                  {idx < progressionStages.length - 1 && <div className="ef-step-connector" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* 5.5 LIVE PROCESS AI ANALYSIS CARD (ON-DEMAND REAL-TIME DIAGNOSTIC REASONING) */}
        <LiveEquipmentAiAnalysisCard
          equipmentId={selectedEquipment}
          equipmentTag={currentUnit.tag}
          equipmentFullName={currentUnit.fullName}
          result={currentAnalysisResult}
          isAnalyzing={isThisEquipmentAnalyzing}
          error={activeAnalysisEquipment === selectedEquipment ? liveAiError : null}
          onAnalyze={() => analyzeEquipment(selectedEquipment)}
          onAskFollowUp={(_question) => onAskAiAboutEquipment(selectedEquipment)}
        />

        {/* 2-COLUMN SPLIT COCKPIT */}
        <div className="ef-split-grid">
          {/* COLUMN A: WHY IS THIS HAPPENING? & PROCESS IMPACT */}
          <div className="ef-col-evidence">
            {/* 6. WHY IS THIS HAPPENING? */}
            <div className="ef-section-box">
              <div className="ef-sec-header">
                <span className="ef-sec-title">WHY IS THIS HAPPENING?</span>
                <span className="ef-sec-badge">Correlated Symptoms</span>
              </div>

              <div className="ef-reasons-list">
                {whyEvidence.reasons.map((r, i) => (
                  <div key={i} className="ef-reason-item">
                    <span className="ef-reason-check">✓</span>
                    <span className="ef-reason-text">{r}</span>
                  </div>
                ))}
              </div>

              <div className="ef-evidence-pills-row">
                <span className="ef-evidence-title">CORRELATED EVIDENCE:</span>
                {whyEvidence.evidence.map((ev, i) => (
                  <span key={i} className="ef-evidence-tag">
                    {ev.label}: <strong>{ev.val}</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* 8. PROCESS IMPACT / DOWNSTREAM CONSEQUENCES */}
            <div className="ef-section-box">
              <div className="ef-sec-header">
                <div className="flex items-center gap-1.5">
                  <GitBranch size={13} color="var(--primary-blue)" />
                  <span className="ef-sec-title">DOWNSTREAM PROCESS IMPACT</span>
                </div>
                <span className="ef-sec-badge">Aspen Mass Flow Chain</span>
              </div>

              <div className="ef-impact-list">
                {downstreamImpacts.map((imp, i) => (
                  <div key={i} className="ef-impact-item">
                    <div className="ef-impact-unit">
                      <span
                        className={`ef-impact-dot ${imp.status === 'affected' ? 'affected' : 'monitoring'}`}
                      />
                      <strong>{imp.tag}</strong>
                      <span className="ef-impact-uname">{imp.name}</span>
                    </div>
                    <div className="ef-impact-desc">{imp.desc}</div>
                  </div>
                ))}
              </div>

              <p className="ef-impact-note">
                ⓘ Downstream changes are physical mass/energy flow consequences of {currentUnit.tag} degradation, not independent equipment faults.
              </p>
            </div>
          </div>

          {/* COLUMN B: WHAT CHANGED? & LIVE TREND CHART */}
          <div className="ef-col-data">
            {/* 7. WHAT CHANGED? (BASELINE COMPARISON) */}
            <div className="ef-section-box">
              <div className="ef-sec-header">
                <span className="ef-sec-title">WHAT CHANGED? (LIVE BASELINE DELTAS)</span>
                <span className="ef-sec-badge">1-Second Tick</span>
              </div>

              <div className="ef-table-wrap">
                <table className="ef-baseline-table">
                  <thead>
                    <tr>
                      <th>VARIABLE</th>
                      <th>BASELINE</th>
                      <th>CURRENT</th>
                      <th>DEVIATION</th>
                      <th>TREND</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baselineRows.map((row, i) => {
                      const pct = (row.delta * 100).toFixed(1);
                      const isUp = Number(pct) > 0;
                      const isDev = Math.abs(row.delta) > 0.05;

                      return (
                        <tr key={i} className={isDev ? 'row-deviated' : ''}>
                          <td className="cell-name">{row.name}</td>
                          <td className="cell-base">{row.baseline}</td>
                          <td className="cell-curr">
                            <strong>{row.current}</strong>
                          </td>
                          <td className="cell-dev">
                            <span
                              className={`ef-dev-pill ${
                                Math.abs(Number(pct)) < 1.0
                                  ? 'dev-nominal'
                                  : isUp
                                  ? 'dev-pos'
                                  : 'dev-neg'
                              }`}
                            >
                              {isUp && Number(pct) > 0.0 ? '+' : ''}
                              {pct}%
                            </span>
                          </td>
                          <td className="cell-trend">
                            {row.trend === 'increasing'
                              ? '↑ Increasing'
                              : row.trend === 'decreasing'
                              ? '↓ Declining'
                              : '→ Stable'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. LIVE TREND CHART WITH PARAMETER SELECTOR */}
            <div className="ef-section-box">
              <div className="ef-chart-head">
                <div className="flex items-center gap-1.5">
                  <BarChart2 size={13} color="var(--primary-blue)" />
                  <span className="ef-sec-title">LIVE TREND ANALYSIS ({currentUnit.tag})</span>
                </div>

                {/* Metric Selector Tabs */}
                <div className="ef-metric-tabs">
                  {activeChartOptions.map((opt) => (
                    <button
                      key={opt.key}
                      className={`ef-metric-tab-btn ${selectedMetric === opt.key ? 'active' : ''}`}
                      onClick={() => setSelectedMetric(opt.key)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ef-chart-container" style={{ height: 160, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={timeSeries}
                    margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 9, fill: '#64748B' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: '#64748B' }}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        fontSize: 11,
                        padding: '4px 8px'
                      }}
                      formatter={(val: any) => [
                        `${Number(val).toFixed(2)} ${currentChartMetric.unit}`,
                        currentChartMetric.label
                      ]}
                    />
                    {/* Baseline reference line */}
                    <ReferenceLine
                      y={currentChartMetric.baseline}
                      stroke="#94A3B8"
                      strokeDasharray="4 4"
                      label={{
                        value: `Baseline: ${currentChartMetric.baseline}`,
                        position: 'insideTopRight',
                        fill: '#64748B',
                        fontSize: 9
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey={currentChartMetric.dataKey}
                      stroke={currentChartMetric.color}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default EarlyFaultMonitoringCockpit;
