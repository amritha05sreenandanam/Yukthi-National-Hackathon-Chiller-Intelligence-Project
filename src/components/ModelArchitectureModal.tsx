import React from 'react';
import {
  X,
  Cpu,
  Brain,
  Layers,
  Sparkles,
  GitBranch,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface ModelArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModelArchitectureModal: React.FC<ModelArchitectureModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-y-auto shadow-2xl p-6 relative text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-5">
          <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Contextual ML Anomaly Detection Architecture
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800">
                YUKTHI 2026 Core Spec
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Two-stage predictive residual modeling + multi-dimensional thermodynamic envelope
            </p>
          </div>
        </div>

        {/* 4 Pipeline Stages Bento */}
        <div className="space-y-4 text-xs">
          {/* Stage 1 */}
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
            <div className="flex items-center gap-2 text-cyan-400 font-bold mb-1.5 uppercase text-[11px]">
              <Layers className="w-4 h-4" />
              <span>Stage 1: Dynamic Ingestion &amp; Psychrometric Imputation</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Ingests raw CSV streams matching the 11-field schema. Temporal gaps are preserved chronologically without penalization. Missing values (~0.16% Chilled Water Rate, ~0.02% Cooling Temp, etc.) are imputed via an autoregressive rolling window (order 5) with global equipment fallback to prevent temporal look-ahead leakage.
            </p>
          </div>

          {/* Stage 2 */}
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-400 font-bold mb-1.5 uppercase text-[11px]">
              <Zap className="w-4 h-4" />
              <span>Stage 2: Contextual Thermodynamic Feature Engineering</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 font-mono text-[11px]">
              <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                <strong className="text-cyan-300">Specific Power (kW/RT):</strong>
                <div className="text-slate-400 mt-0.5">Power (kW) / Building Load (RT)</div>
              </div>
              <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                <strong className="text-cyan-300">Stull Psychrometric Wet-Bulb:</strong>
                <div className="text-slate-400 mt-0.5">Twb = f(Outside Temp, Humidity)</div>
              </div>
              <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                <strong className="text-cyan-300">Cooling Approach (Lift):</strong>
                <div className="text-slate-400 mt-0.5">Cooling Water Temp (°C) - Twb (°C)</div>
              </div>
              <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                <strong className="text-cyan-300">Hydraulic Ratio:</strong>
                <div className="text-slate-400 mt-0.5">Chilled Rate (L/s) / Load (RT)</div>
              </div>
            </div>
          </div>

          {/* Stage 3 */}
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
            <div className="flex items-center gap-2 text-purple-400 font-bold mb-1.5 uppercase text-[11px]">
              <GitBranch className="w-4 h-4" />
              <span>Stage 3: Contextual Expected Energy Regression</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Energy consumption strongly couples with Building Load (RT) and Outdoor Weather (F). An equipment-specific Ridge regressor with non-linear interaction terms fits the expected energy baseline:
            </p>
            <div className="mt-2 p-2.5 bg-slate-950 font-mono text-cyan-300 rounded border border-slate-800 text-center">
              Ê = w₁·Load + w₂·Tout + w₃·Tcw + w₄·Flow + w₅·(Load × Lift) + b
            </div>
            <p className="mt-2 text-slate-400">
              Residual e_t = E_actual - Ê represents unaccounted excess consumption.
            </p>
          </div>

          {/* Stage 4 */}
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
            <div className="flex items-center gap-2 text-rose-400 font-bold mb-1.5 uppercase text-[11px]">
              <ShieldCheck className="w-4 h-4" />
              <span>Stage 4: Multi-Dimensional Outlier Scoring &amp; Root-Cause Explainability</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Integrates residual Z-score, specific power Z-score, condenser approach penalties, and hydraulic flow penalties into a unified 0-100 severity index:
            </p>
            <ul className="mt-2 space-y-1 text-slate-400 list-disc list-inside">
              <li><strong className="text-rose-400">Critical (80-100):</strong> Massive compressor power spike, severe thermodynamic breakdown.</li>
              <li><strong className="text-amber-400">High (65-79):</strong> Substantial condenser tube fouling or extreme Low Delta-T bypass.</li>
              <li><strong className="text-yellow-400">Medium (45-64):</strong> Elevated power draw relative to building occupancy.</li>
              <li><strong className="text-slate-300">Normal (&lt;35):</strong> Operating inside standard ASHRAE efficiency boundaries.</li>
            </ul>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
          >
            Close Documentation
          </button>
        </div>
      </div>
    </div>
  );
};
