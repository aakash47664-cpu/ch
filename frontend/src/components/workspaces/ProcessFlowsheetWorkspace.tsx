import React from 'react';
import {
  ProcessUpdatePayload,
  TimeSeriesPoint,
  FaultMode
} from '../../types';
import { ProcessFlowsheet } from '../ProcessFlowsheet';

interface ProcessFlowsheetWorkspaceProps {
  state: ProcessUpdatePayload;
  timeSeries: TimeSeriesPoint[];
  selectedEquipment?: string;
  onSelectEquipment?: (unitId: string) => void;
  onAskAiAbout?: (unitId: string) => void;
  onSelectFault?: (fault: FaultMode) => void;
}

export const ProcessFlowsheetWorkspace: React.FC<ProcessFlowsheetWorkspaceProps> = ({
  state,
  timeSeries,
  selectedEquipment,
  onSelectEquipment,
  onAskAiAbout,
  onSelectFault
}) => {
  return (
    <div className="flowsheet-workspace">
      <ProcessFlowsheet
        state={state}
        selectedEquipment={selectedEquipment}
        onSelectEquipment={onSelectEquipment}
        onAskAiAbout={onAskAiAbout}
        timeSeries={timeSeries}
        onSelectFault={onSelectFault}
      />
    </div>
  );
};
