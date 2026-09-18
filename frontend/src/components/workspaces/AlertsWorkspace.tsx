import React from 'react';
import {
  ProcessUpdatePayload,
  AlertItem,
  IntelligentAlert
} from '../../types';
import { ActiveAlertsCard } from '../ActiveAlertsCard';
import { AlertsPanel } from '../AlertsPanel';
import { Bell, AlertTriangle, ShieldCheck } from 'lucide-react';

interface AlertsWorkspaceProps {
  state: ProcessUpdatePayload;
  alerts: AlertItem[];
  onNavigateTab: (tab: 'overview' | 'flowsheet' | 'pump' | 'heat_exchanger' | 'reactor' | 'distillation' | 'ai_diagnosis' | 'alerts') => void;
  onAlertsUpdated?: () => void;
  onAskAiAbout?: (unitId: string) => void;
}

export const AlertsWorkspace: React.FC<AlertsWorkspaceProps> = ({
  state,
  alerts,
  onNavigateTab,
  onAlertsUpdated,
  onAskAiAbout
}) => {
  const handleAlertEquipmentClick = (equipmentId: string) => {
    const equipLower = equipmentId.toLowerCase();
    if (equipLower.includes('p-101') || equipLower.includes('pump')) {
      onNavigateTab('pump');
    } else if (equipLower.includes('e-101') || equipLower.includes('exchanger')) {
      onNavigateTab('heat_exchanger');
    } else if (equipLower.includes('r-101') || equipLower.includes('reactor')) {
      onNavigateTab('reactor');
    } else if (equipLower.includes('d-101') || equipLower.includes('distill') || equipLower.includes('column')) {
      onNavigateTab('distillation');
    }
  };

  const handleAnalyzeWithAi = (alert: IntelligentAlert) => {
    handleAlertEquipmentClick(alert.equipment);
    if (onAskAiAbout) {
      let equipId = 'pump';
      const eq = alert.equipment.toLowerCase();
      if (eq.includes('p-101') || eq.includes('pump')) equipId = 'pump';
      else if (eq.includes('e-101') || eq.includes('exchanger')) equipId = 'heat_exchanger';
      else if (eq.includes('r-101') || eq.includes('reactor')) equipId = 'reactor';
      else if (eq.includes('d-101') || eq.includes('distill') || eq.includes('column')) equipId = 'distillation';
      onAskAiAbout(equipId);
    }
  };

  return (
    <div className="alerts-workspace">
      {/* Workspace Header */}
      <div className="workspace-header-banner">
        <div className="flex items-center gap-3">
          <div className="workspace-icon-box bg-rose-50 text-rose-700">
            <Bell size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="workspace-title">ACTIVE ALERTS &amp; DIAGNOSTIC AUDIT CENTER</h2>
              <span className={`status-badge ${(state.active_alerts || []).length > 0 ? 'critical' : 'nominal'}`}>
                {(state.active_alerts || []).length > 0 ? `${(state.active_alerts || []).length} ACTIVE` : 'ALL NOMINAL'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Alert Center Cards */}
      <div className="space-y-4">
        <ActiveAlertsCard
          alerts={state.active_alerts || []}
          alertSummary={state.alert_summary}
          onSelectEquipment={handleAlertEquipmentClick}
          onAnalyzeWithAi={handleAnalyzeWithAi}
          onAlertsUpdated={onAlertsUpdated}
        />

        <AlertsPanel alerts={alerts} />
      </div>
    </div>
  );
};
