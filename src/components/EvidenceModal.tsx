import React from 'react';
import {
  X,
  AlertTriangle,
  Zap,
  Gauge,
  Thermometer,
  Activity,
  CheckCircle2,
  Wrench,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { ChillerRecord } from '../types';

interface EvidenceModalProps {
  record: ChillerRecord | null;
  onClose: () => void;
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({ record, onClose }) => {
  if (!record) return null;

  const isCritical = record.severity === 'CRITICAL';
  const isHigh = record.severity === 'HIGH';

  // Calculate thermodynamic delta
  const excessEnergy = Math.max(0, record.energy_residual_kwh);
  const wastedCost = (excessEnergy * 0.12).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 border-b border-slate-800 pb-4 mb-5">
          <div
            className={`p-3 rounded-xl ${
              isCritical
                ? 'bg-rose-500/20 text-rose-400'
                : isHigh
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Root-Cause Anomaly Investigation
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  isCritical
                    ? 'bg-rose-950 text-rose-300 border-rose-800'
                    : isHigh
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : 'bg-yellow-950 text-yellow-300 border-yellow-800'
                }`}
              >
                {record.severity} ({record.anomaly_score}/100)
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Unit: <strong className="text-slate-200">{record.equipment_id}</strong> | Timestamp:{' '}
              <strong className="text-cyan-400">{record.timestamp}</strong>
            </p>
          </div>
        </div>

        {/* Diagnostic Metrics Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {/* Actual vs Expected */}
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Energy Draw
            </div>
            <div className="text-lg font-bold font-mono text-cyan-400">
              {record.energy_consumption} <span className="text-xs text-slate-400">kWh</span>
            </div>
            <div className="text-[11px] text-rose-400 font-medium">
              +{record.energy_residual_kwh} kWh (+{record.percent_deviation}%)
            </div>
            <div className="text-[10px] text-slate-500">Exp: {record.expected_energy_kwh} kWh</div>
          </div>

          {/* Specific Power */}
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-blue-400" />
              Specific Power
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {record.specific_power_kw_rt} <span className="text-xs text-slate-400">kW/RT</span>
            </div>
            <div className="text-[11px] text-slate-300 font-medium">
              COP: <strong className="text-cyan-300">{record.cop}</strong>
            </div>
            <div className="text-[10px] text-slate-500">Target: ~0.58-0.65</div>
          </div>

          {/* Cooling Approach */}
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-amber-400" />
              Cooling Approach
            </div>
            <div className="text-lg font-bold font-mono text-amber-400">
              {record.cooling_approach_c} <span className="text-xs text-slate-400">°C</span>
            </div>
            <div className="text-[11px] text-slate-300">
              Twb: {record.wet_bulb_temp_c}°C
            </div>
            <div className="text-[10px] text-slate-500">Cw: {record.cooling_water_temp}°C</div>
          </div>

          {/* Flow to Load Ratio */}
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Flow / Load
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400">
              {record.flow_per_rt} <span className="text-xs text-slate-400">L/s/RT</span>
            </div>
            <div className="text-[11px] text-slate-300">
              Load: {record.building_load} RT
            </div>
            <div className="text-[10px] text-slate-500">Flow: {record.chilled_water_rate} L/s</div>
          </div>
        </div>

        {/* Root-Cause Evidence Breakdown */}
        <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-4 mb-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5 mb-2.5">
            <AlertTriangle className="w-4 h-4" /> Physical Subsystem Anomaly Evidence
          </h4>
          <div className="space-y-2">
            {record.evidence_reasons && record.evidence_reasons.length > 0 ? (
              record.evidence_reasons.map((reason, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 text-xs text-slate-200 bg-rose-950/20 border border-rose-900/40 p-2.5 rounded-lg leading-relaxed"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <span>{reason}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 italic">
                Anomaly triggered by multi-variable contextual regression excursion exceeding 2.5 standard deviations.
              </div>
            )}
          </div>
        </div>

        {/* Prescriptive Operational Recommendations */}
        <div className="bg-blue-950/20 border border-blue-900/50 rounded-xl p-4 mb-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5 mb-2">
            <Wrench className="w-4 h-4 text-cyan-400" /> Actionable Engineering Recommendation
          </h4>
          <p className="text-xs text-slate-200 leading-relaxed">
            {record.recommendation ||
              'Inspect physical instrumentation and verify chiller plant control sequencing.'}
          </p>
        </div>

        {/* Financial & Environmental Loss */}
        <div className="flex items-center justify-between p-3.5 bg-slate-800/80 rounded-xl border border-slate-700 text-xs text-slate-300">
          <div>
            <span className="text-slate-400">Single Interval Energy Waste:</span>{' '}
            <strong className="text-rose-400 font-mono">+{excessEnergy} kWh</strong>
          </div>
          <div>
            <span className="text-slate-400">Estimated Direct Waste:</span>{' '}
            <strong className="text-emerald-400 font-mono">${wastedCost} USD</strong>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
          >
            Close Investigation
          </button>
        </div>
      </div>
    </div>
  );
};
