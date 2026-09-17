import React, { useState } from 'react';
import { ProcessUpdatePayload } from '../../types';
import { EquipmentContinuousMlPanel } from '../EquipmentContinuousMlPanel';

interface MlMonitoringWorkspaceProps {
  state: ProcessUpdatePayload;
  initialEquipmentId?: string;
  onNavigateTab?: (tab: 'overview' | 'flowsheet' | 'pump' | 'heat_exchanger' | 'reactor' | 'distillation' | 'ai_diagnosis' | 'alerts') => void;
  onAskAiAbout?: (unitId: string) => void;
}

export const MlMonitoringWorkspace: React.FC<MlMonitoringWorkspaceProps> = ({
  state,
  initialEquipmentId = 'heat_exchanger',
  onNavigateTab,
  onAskAiAbout
}) => {
  const [selectedUnitId, setSelectedUnitId] = useState<string>(initialEquipmentId);

  const eqDiagnostics = state.equipment_diagnostics || (state as any).equipmentDiagnostics || {};

  // Unit lookup mapping
  const unitMap: Record<string, { tag: string; name: string; diag: any }> = {
    pump: { tag: 'P-101', name: 'Pump (6V Mini Centrifugal)', diag: eqDiagnostics.P101 || eqDiagnostics.pump },
    heat_exchanger: { tag: 'E-101', name: 'Heat Exchanger (Shell & Tube)', diag: eqDiagnostics.E101 || eqDiagnostics.heat_exchanger },
    reactor: { tag: 'R-101', name: 'Continuous Stirred-Tank Reactor (CSTR)', diag: eqDiagnostics.R101 || eqDiagnostics.reactor },
    distillation: { tag: 'distillation', name: 'Binary Distillation Column', diag: eqDiagnostics.D101 || eqDiagnostics.distillation }
  };

  const currentUnit = unitMap[selectedUnitId] || unitMap.heat_exchanger;

  return (
    <div className="ml-monitoring-workspace">
      <EquipmentContinuousMlPanel
        diagnostic={currentUnit.diag}
        allDiagnostics={eqDiagnostics}
        unitTag={currentUnit.tag}
        unitName={currentUnit.name}
        onSelectUnit={(id) => setSelectedUnitId(id)}
        onNavigateTab={onNavigateTab}
        onAskAiAbout={onAskAiAbout}
      />
    </div>
  );
};
