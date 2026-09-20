import React from 'react';
import {
  Activity,
  Zap,
  Gauge,
  AlertTriangle,
  TrendingDown,
  Clock,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import { EquipmentSummary, SystemSummary } from '../types';

interface OverviewCardsProps {
  currentEquipment?: EquipmentSummary;
  systemSummary?: SystemSummary;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({
  currentEquipment,
  systemSummary,
}) => {
  if (!currentEquipment) return null;

  // Color mapping based on health score
  const health = currentEquipment.health_score;
  let healthBadgeColor = 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60';
  let healthStatus = 'Optimal';
  if (health < 60) {
    healthBadgeColor = 'text-rose-400 bg-rose-950/60 border-rose-800/60';
    healthStatus = 'Critical Attention';
  } else if (health < 80) {
    healthBadgeColor = 'text-amber-400 bg-amber-950/60 border-amber-800/60';
    healthStatus = 'Degraded';
  }

  // Cost wasted during anomalies
  const wastedCostUsd = Math.round(currentEquipment.potential_savings_kwh * 0.12);

  return (
    <div id="overview-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Health Index */}
      <div id="card-health-index" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">Unit Health Index</span>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2.5">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
            {health}%
          </span>
          <span
            className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${healthBadgeColor}`}
          >
            {healthStatus}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>Fleet Avg: {systemSummary?.fleet_health_score || 85}%</span>
          <span>{currentEquipment.record_count} Timestamps</span>
        </div>
        {/* Visual progress bar */}
        <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              health >= 80 ? 'bg-emerald-500' : health >= 60 ? 'bg-amber-500' : 'bg-rose-500'
            }`}
            style={{ width: `${health}%` }}
          />
        </div>
      </div>

      {/* 2. Specific Power (kW / RT) */}
      <div id="card-specific-power" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">Avg Efficiency (Specific Power)</span>
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
            <Gauge className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
            {currentEquipment.avg_specific_power_kw_rt}
          </span>
          <span className="text-sm font-medium text-slate-400">kW / RT</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            Avg COP: <strong className="text-slate-200 font-mono">{currentEquipment.avg_cop}</strong>
          </span>
          <span className="text-slate-500">Benchmark: &lt;0.62</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          {currentEquipment.avg_specific_power_kw_rt > 0.68 ? (
            <span className="text-amber-400 flex items-center gap-1">
              <Flame className="w-3 h-3" /> Lift penalty detected
            </span>
          ) : (
            <span className="text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Within nominal ASHRAE 90.1 standard
            </span>
          )}
        </div>
      </div>

      {/* 3. Contextual Anomalies Detected */}
      <div id="card-anomalies-detected" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">Detected Anomalies</span>
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
            {currentEquipment.anomaly_count}
          </span>
          <span className="text-xs font-semibold text-slate-400">
            / {currentEquipment.record_count} points
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs">
          {currentEquipment.critical_count > 0 && (
            <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/80 font-mono text-[11px]">
              {currentEquipment.critical_count} Critical
            </span>
          )}
          {currentEquipment.high_count > 0 && (
            <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/80 font-mono text-[11px]">
              {currentEquipment.high_count} High
            </span>
          )}
          {currentEquipment.medium_count > 0 && (
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono text-[11px]">
              {currentEquipment.medium_count} Med
            </span>
          )}
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          Rate: {((currentEquipment.anomaly_count / Math.max(1, currentEquipment.record_count)) * 100).toFixed(1)}% of operational timeline
        </div>
      </div>

      {/* 4. Total Energy & Savings Potential */}
      <div id="card-energy-savings" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">Energy &amp; Savings Potential</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
            {currentEquipment.total_energy_kwh.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-slate-400">kWh</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-emerald-400 font-medium">
            Save {currentEquipment.potential_savings_kwh.toLocaleString()} kWh
          </span>
          <span className="text-emerald-300 font-mono font-semibold">
            ≈ ${wastedCostUsd.toLocaleString()}
          </span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          Recoverable through scheduled maintenance &amp; setpoint tuning
        </div>
      </div>
    </div>
  );
};
