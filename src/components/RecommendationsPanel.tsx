import React from 'react';
import {
  Wrench,
  AlertOctagon,
  Settings2,
  CalendarCheck,
  TrendingDown,
  DollarSign,
  Leaf,
  CheckCircle,
} from 'lucide-react';
import { EquipmentSummary } from '../types';

interface RecommendationsPanelProps {
  currentEquipment?: EquipmentSummary;
}

export const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({
  currentEquipment,
}) => {
  if (!currentEquipment) return null;

  const savingsKwh = currentEquipment.potential_savings_kwh;
  const costSavingsUsd = Math.round(savingsKwh * 0.12);
  const carbonTons = ((savingsKwh * 0.85) / 1000).toFixed(1); // ~0.85 lbs CO2 per kWh

  return (
    <div id="recommendations-panel" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white tracking-tight">
              Actionable Operational &amp; Maintenance Recommendations
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
              ROI &amp; Reliability Optimization
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Synthesized domain interventions mapped directly to detected thermodynamic faults in {currentEquipment.equipment_id}
          </p>
        </div>

        {/* Projected Impact Pill */}
        <div className="flex items-center gap-3 bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <DollarSign className="w-4 h-4" />
            <span>${costSavingsUsd.toLocaleString()} / mo saved</span>
          </div>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex items-center gap-1 text-slate-300">
            <Leaf className="w-3.5 h-3.5 text-emerald-400" />
            <span>{carbonTons} t CO₂e avoided</span>
          </div>
        </div>
      </div>

      {/* Actionable Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tier 1: Immediate Critical Action */}
        <div id="rec-tier-1" className="bg-slate-800/40 border border-rose-900/40 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-950 text-rose-300 border border-rose-800">
                Priority 1: Immediate
              </span>
              <AlertOctagon className="w-4 h-4 text-rose-400" />
            </div>
            <h4 className="text-sm font-semibold text-white mb-1.5">
              Condenser Tube Scale &amp; Tower Approach
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Elevated cooling approach (&gt;8°C over ambient wet-bulb) points to biofouling or scale build-up inside the shell-and-tube bundle.
            </p>
            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Schedule rotary mechanical tube brushing</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Verify cooling tower water biocidal chemistry</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Lift Penalty Reduction:</span>
            <strong className="text-emerald-400 font-mono">-8% to -12% kW</strong>
          </div>
        </div>

        {/* Tier 2: Hydraulic & Delta-T Tuning */}
        <div id="rec-tier-2" className="bg-slate-800/40 border border-amber-900/40 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-950 text-amber-300 border border-amber-800">
                Priority 2: Operational Tuning
              </span>
              <Settings2 className="w-4 h-4 text-amber-400" />
            </div>
            <h4 className="text-sm font-semibold text-white mb-1.5">
              Low Delta-T Mitigation &amp; Decoupler Audit
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              High flow-to-load ratio (&gt;0.65 L/s per RT) causes excessive hydraulic pumping and premature staging of supplemental chillers.
            </p>
            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Inspect primary-secondary bridge check valves</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Re-stroke modulating 2-way AHU cooling valves</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Pump Energy Reduction:</span>
            <strong className="text-emerald-400 font-mono">-15% Hydraulic kWh</strong>
          </div>
        </div>

        {/* Tier 3: Preventative & Sensor Health */}
        <div id="rec-tier-3" className="bg-slate-800/40 border border-blue-900/40 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-950 text-blue-300 border border-blue-800">
                Priority 3: Supervisory BMS
              </span>
              <CalendarCheck className="w-4 h-4 text-blue-400" />
            </div>
            <h4 className="text-sm font-semibold text-white mb-1.5">
              Sensor Calibration &amp; Chilled Water Reset
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Sporadic residual anomalies suggest sensor drift on temperature wells and fixed supply temperature during mild weather.
            </p>
            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Implement outdoor air reset (OAR) schedule</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Recalibrate RTD thermistors and DP flow meters</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Efficiency Gain:</span>
            <strong className="text-emerald-400 font-mono">+0.3 COP average</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
