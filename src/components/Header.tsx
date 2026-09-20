import React from 'react';
import {
  Activity,
  UploadCloud,
  Download,
  Sliders,
  RotateCcw,
  Zap,
  Info,
} from 'lucide-react';
import { EquipmentSummary } from '../types';

interface HeaderProps {
  equipments: EquipmentSummary[];
  selectedEquipment: string;
  onSelectEquipment: (id: string) => void;
  sensitivity: number;
  onSensitivityChange: (val: number) => void;
  onOpenUpload: () => void;
  onOpenModelInfo: () => void;
  onResetData: () => void;
  isResetting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  equipments,
  selectedEquipment,
  onSelectEquipment,
  sensitivity,
  onSensitivityChange,
  onOpenUpload,
  onOpenModelInfo,
  onResetData,
  isResetting,
}) => {
  const currentUnit = equipments.find((e) => e.equipment_id === selectedEquipment);

  const handleExport = () => {
    const link = document.createElement('a');
    link.href = `/api/export/${selectedEquipment}`;
    link.download = `${selectedEquipment}_contextual_anomalies.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <header id="main-header" className="bg-slate-900 text-slate-100 border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Brand & Hackathon Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Yukthi Chiller Intelligence
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                  YUKTHI 2026
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Unsupervised Contextual Anomaly Detection &amp; Efficiency Pipeline
              </p>
            </div>
          </div>

          {/* Center: Chiller Selector Tabs */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 overflow-x-auto">
            {equipments.map((eq) => {
              const isActive = eq.equipment_id === selectedEquipment;
              const hasCritical = eq.critical_count > 0;
              return (
                <button
                  key={eq.equipment_id}
                  id={`tab-${eq.equipment_id}`}
                  onClick={() => onSelectEquipment(eq.equipment_id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <span>{eq.equipment_id}</span>
                  {eq.anomaly_count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        hasCritical
                          ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                          : 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                      }`}
                    >
                      {eq.anomaly_count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sensitivity Slider Tooltip / Popover */}
            <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700/70 text-xs">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400 hidden sm:inline">Sensitivity:</span>
              <span className="font-semibold text-cyan-300 font-mono">{sensitivity}</span>
              <input
                type="range"
                min={25}
                max={75}
                step={5}
                value={sensitivity}
                onChange={(e) => onSensitivityChange(parseInt(e.target.value, 10))}
                className="w-18 sm:w-24 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                title="Adjust ML Anomaly Detection Sensitivity Threshold"
              />
            </div>

            {/* Upload CSV */}
            <button
              id="btn-upload-csv"
              onClick={onOpenUpload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition"
              title="Upload new CSV dataset"
            >
              <UploadCloud className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Upload CSV</span>
            </button>

            {/* Export Report */}
            <button
              id="btn-export-csv"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition"
              title="Export Anomaly Analysis as CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Architecture / Pipeline Info */}
            <button
              id="btn-model-info"
              onClick={onOpenModelInfo}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition"
              title="ML Architecture & Pipeline Spec"
            >
              <Info className="w-4 h-4 text-cyan-400" />
            </button>

            {/* Reset */}
            <button
              id="btn-reset-data"
              onClick={onResetData}
              disabled={isResetting}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg border border-slate-700 transition disabled:opacity-50"
              title="Reload Benchmark Dataset"
            >
              <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
